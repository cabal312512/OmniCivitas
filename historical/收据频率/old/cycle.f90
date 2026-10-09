module calendar_stock
  use water_data
  implicit none
contains
  integer(ik) function due_tick(device, drift_per_day, permitted_error) result(due)
    type(instrument), intent(in) :: device
    real(rk), intent(in) :: drift_per_day, permitted_error
    integer(ik) :: drift_days
    due = device%last_service + device%interval
    if (drift_per_day > 0.0_rk .and. permitted_error > device%curve%rms) then
      drift_days = int((permitted_error - device%curve%rms) / drift_per_day, ik)
      due = min(due, device%last_service + drift_days * 1440_ik)
    else if (permitted_error <= device%curve%rms) then
      due = device%last_service
    end if
  end function
  subroutine linear_drift(ticks, offsets, count, per_day, accepted)
    integer, intent(in) :: count
    integer(ik), intent(in) :: ticks(count)
    real(rk), intent(in) :: offsets(count)
    real(rk), intent(out) :: per_day
    logical, intent(out) :: accepted
    real(rk) :: mx, my, xx, xy, x
    integer :: i
    accepted = .false.
    per_day = 0.0_rk
    if (count < 2) return
    mx = 0.0_rk
    my = sum(offsets) / real(count, rk)
    do i = 1, count
      mx = mx + real(ticks(i) - ticks(1), rk) / 1440.0_rk
    end do
    mx = mx / real(count, rk)
    xx = 0.0_rk
    xy = 0.0_rk
    do i = 1, count
      x = real(ticks(i) - ticks(1), rk) / 1440.0_rk - mx
      xx = xx + x*x
      xy = xy + x*(offsets(i) - my)
    end do
    if (xx <= epsilon(xx)) return
    per_day = xy / xx
    accepted = .true.
  end subroutine
  subroutine overdue(data, now, ids, count)
    type(archive), intent(in) :: data
    integer(ik), intent(in) :: now
    integer, intent(out) :: ids(max_instruments), count
    integer :: i
    ids = 0
    count = 0
    do i = 1, data%item_count
      if (data%items(i)%state /= retired .and. &
          data%items(i)%last_service + data%items(i)%interval <= now) then
        count = count + 1
        ids(count) = data%items(i)%id
      end if
    end do
  end subroutine
end module
