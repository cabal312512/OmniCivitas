module drawer_compare
  use water_data
  implicit none
  type :: comparison
    integer :: matched = 0, left_only = 0, right_only = 0
    real(rk) :: mean_change = 0.0_rk, peak_change = 0.0_rk, rms_change = 0.0_rk
    integer :: point(max_points) = 0
    real(rk) :: delta(max_points) = 0.0_rk
  end type
contains
  subroutine align(left, right, left_curve, right_curve, output)
    type(reading_batch), intent(in) :: left, right
    type(calibration), intent(in) :: left_curve, right_curve
    type(comparison), intent(out) :: output
    logical :: used(max_points)
    integer :: i, j, hit, k
    real(rk) :: difference, total, square
    output = comparison()
    used = .false.
    total = 0.0_rk
    square = 0.0_rk
    do i = 1, left%count
      if (left%points(i)%missing .or. left%points(i)%quality /= 0) cycle
      hit = 0
      do j = 1, right%count
        if (used(j) .or. right%points(j)%missing .or. right%points(j)%quality /= 0) cycle
        if (left%points(i)%point == right%points(j)%point) then
          hit = j
          exit
        end if
      end do
      if (hit == 0) then
        output%left_only = output%left_only + 1
        cycle
      end if
      used(hit) = .true.
      difference = corrected(right_curve, right%points(hit)%observed) - &
                   corrected(left_curve, left%points(i)%observed)
      output%matched = output%matched + 1
      k = output%matched
      output%point(k) = left%points(i)%point
      output%delta(k) = difference
      total = total + difference
      square = square + difference*difference
      output%peak_change = max(output%peak_change, abs(difference))
    end do
    do j = 1, right%count
      if (.not. used(j) .and. .not. right%points(j)%missing) output%right_only = output%right_only + 1
    end do
    if (output%matched > 0) then
      output%mean_change = total / real(output%matched, rk)
      output%rms_change = sqrt(square / real(output%matched, rk))
    end if
  end subroutine
  logical function compatible(left, right) result(ok)
    type(reading_batch), intent(in) :: left, right
    ok = left%instrument == right%instrument .and. trim(left%unit) == trim(right%unit)
  end function
end module
