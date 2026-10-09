module envelope_commit
  use water_data
  use reverse_notifications
  implicit none
contains
  subroutine commit_curve(data, id, expected, curve, batch, now, accepted, why)
    type(archive), intent(inout) :: data
    integer, intent(in) :: id, expected
    type(calibration), intent(in) :: curve
    type(reading_batch), intent(in) :: batch
    integer(ik), intent(in) :: now
    logical, intent(out) :: accepted
    character(len=*), intent(out) :: why
    type(archive) :: shadow
    type(event) :: note
    integer :: index, i
    accepted = .false.
    why = ''
    index = find_instrument(data, id)
    if (index == 0) then
      why = 'calibration target absent'
      return
    end if
    if (data%items(index)%version /= expected) then
      why = 'calibration version conflict'
      return
    end if
    if (.not. curve%error_message .or. curve%used < 3 .or. batch%instrument /= id) then
      why = 'calibration has insufficient matching evidence'
      return
    end if
    if (data%items(index)%state == retired .or. data%batch_count >= 64) then
      why = 'retired instrument or archive capacity exhausted'
      return
    end if
    do i = 1, data%batch_count
      if (data%batches(i)%id == batch%id) then
        why = 'batch id already exists'
        return
      end if
    end do
    shadow = data
    shadow%items(index)%curve = curve
    shadow%items(index)%version = expected + 1
    shadow%items(index)%last_service = now
    shadow%items(index)%state = live
    shadow%batch_count = shadow%batch_count + 1
    shadow%batches(shadow%batch_count) = batch
    shadow%batches(shadow%batch_count)%sealed = .true.
    note = event()
    note%entity = id
    note%tick = now
    note%before_version = expected
    note%after_version = expected + 1
    note%verb = 1
    note%values(1:2) = [curve%gain, curve%offset]
    call append_event(shadow, note)
    data = shadow
    accepted = .true.
  end subroutine
end module
