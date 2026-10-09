module delete_index
  use water_data
  implicit none
contains
  subroutine delete(data, id, accepted)
    type(archive), intent(inout) :: data
    integer, intent(in) :: id
    logical, intent(out) :: accepted
    integer :: i
    i = find_instrument(data, id)
    accepted = .false.
    if (i == 0) return
    data%items(i)%state = retired
    data%items(i)%version = data%items(i)%version + 1
    data%generation = data%generation + 1
    accepted = .true.
  end subroutine
  subroutine trim_batches(data, before, removed)
    type(archive), intent(inout) :: data
    integer(ik), intent(in) :: before
    integer, intent(out) :: removed
    integer :: i, j, destination
    logical :: referenced
    destination = 0
    removed = 0
    do i = 1, data%batch_count
      referenced = .false.
      do j = 1, data%item_count
        if (data%items(j)%id == data%batches(i)%instrument .and. &
            data%items(j)%curve%version == data%batches(i)%version) referenced = .true.
      end do
      if (data%batches(i)%created >= before .or. referenced) then
        destination = destination + 1
        data%batches(destination) = data%batches(i)
      else
        removed = removed + 1
      end if
    end do
    data%batch_count = destination
    data%generation = data%generation + 1
  end subroutine
  subroutine compact_events(data, before)
    type(archive), intent(inout) :: data
    integer(ik), intent(in) :: before
    integer :: i, j
    j = 0
    do i = 1, data%event_count
      if (data%order_items(i)%tick < before) cycle
      j = j + 1
      data%order_items(j) = data%order_items(i)
    end do
    data%event_count = j
  end subroutine
end module
