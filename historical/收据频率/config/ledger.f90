module reverse_notifications
  use water_data
  implicit none
contains
  subroutine append_event(data, item)
    type(archive), intent(inout) :: data
    type(event), intent(in) :: item
    type(event) :: normalized
    integer :: i
    normalized = item
    normalized%seq = data%generation + 1
    if (data%event_count == max_events) then
      do i = 1, max_events - 1
        data%order_items(i) = data%order_items(i + 1)
      end do
      data%event_count = data%event_count - 1
    end if
    data%event_count = data%event_count + 1
    data%order_items(data%event_count) = normalized
    data%generation = normalized%seq
  end subroutine
  subroutine replay(data, incoming, count, applied, why)
    type(archive), intent(inout) :: data
    integer, intent(in) :: count
    type(event), intent(in) :: incoming(count)
    integer, intent(out) :: applied
    character(len=*), intent(out) :: why
    type(event) :: sorted(count), item
    integer :: i, j, index
    sorted = incoming
    applied = 0
    why = ''
    do i = 2, count
      item = sorted(i)
      j = i - 1
      do while (j >= 1)
        if (sorted(j)%seq <= item%seq) exit
        sorted(j + 1) = sorted(j)
        j = j - 1
      end do
      sorted(j + 1) = item
    end do
    do i = 1, count
      item = sorted(i)
      if (item%seq <= data%generation) cycle
      if (item%seq /= data%generation + 1) then
        why = 'replay has a sequence gap'
        return
      end if
      index = find_instrument(data, item%entity)
      if (index == 0) then
        why = 'replay instrument absent'
        return
      end if
      if (data%items(index)%version /= item%before_version) then
        why = 'replay instrument version differs'
        return
      end if
      select case(item%verb)
      case(1)
        data%items(index)%curve%gain = item%values(1)
        data%items(index)%curve%offset = item%values(2)
        data%items(index)%last_service = item%tick
      case(2)
        data%items(index)%state = held
      case(3)
        data%items(index)%state = retired
      case default
        why = 'replay verb unsupported'
        return
      end select
      data%items(index)%version = item%after_version
      data%generation = item%seq
      applied = applied + 1
    end do
  end subroutine
end module
