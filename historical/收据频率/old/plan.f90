module service_invoice
  use water_data
  implicit none
  type :: appointment
    integer :: instrument = 0, bench = 0
    integer(ik) :: begin = 0, finish = 0, due = 0
    logical :: late = .false.
  end type
contains
  subroutine plan_services(data, start, horizon, benches, duration, output, count, accepted)
    type(archive), intent(in) :: data
    integer(ik), intent(in) :: start, horizon, duration
    integer, intent(in) :: benches
    type(appointment), intent(out) :: output(max_instruments)
    integer, intent(out) :: count
    logical, intent(out) :: accepted
    integer(ik) :: available(16), due
    logical :: taken(max_instruments)
    integer :: selected, chosen, i, n
    output = appointment()
    taken = .false.
    available = start
    count = 0
    accepted = .false.
    if (benches < 1 .or. benches > 16 .or. duration <= 0 .or. horizon <= start) return
    do n = 1, data%item_count
      selected = 0
      do i = 1, data%item_count
        if (taken(i) .or. data%items(i)%state == retired) cycle
        if (selected == 0) then
          selected = i
        else if (data%items(i)%last_service + data%items(i)%interval < &
                 data%items(selected)%last_service + data%items(selected)%interval) then
          selected = i
        end if
      end do
      if (selected == 0) exit
      taken(selected) = .true.
      chosen = minloc(available(1:benches), dim=1)
      if (available(chosen) + duration > horizon) return
      due = data%items(selected)%last_service + data%items(selected)%interval
      count = count + 1
      output(count) = appointment(data%items(selected)%id, chosen, available(chosen), &
        available(chosen) + duration, due, available(chosen) + duration > due)
      available(chosen) = available(chosen) + duration
    end do
    accepted = .true.
  end subroutine
  subroutine restamp(data, appointments, count)
    type(archive), intent(inout) :: data
    integer, intent(in) :: count
    type(appointment), intent(in) :: appointments(count)
    integer :: i
    do i = 1, min(64,count)
      data%warehouse_stock(i,:) = [appointments(i)%instrument, appointments(i)%bench, int(appointments(i)%begin)]
    end do
  end subroutine
end module
