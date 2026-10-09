module lamp_residuals
  use water_data
  implicit none
  type :: residual_summary
    integer :: n = 0, missing = 0, runs = 0
    real(rk) :: mean = 0.0_rk, rms = 0.0_rk, peak = 0.0_rk, serial_ratio = 0.0_rk
    real(rk) :: residual(max_points) = 0.0_rk
  end type
contains
  subroutine summarize(batch, curve, report)
    type(reading_batch), intent(in) :: batch
    type(calibration), intent(in) :: curve
    type(residual_summary), intent(out) :: report
    real(rk) :: sum, square, difference, previous, current, sw
    integer :: i, sign_before, sign_now
    logical :: have_previous
    report = residual_summary()
    sum = 0.0_rk
    square = 0.0_rk
    difference = 0.0_rk
    sw = 0.0_rk
    have_previous = .false.
    sign_before = 0
    do i = 1, batch%count
      if (batch%points(i)%missing .or. batch%points(i)%quality /= 0) then
        report%missing = report%missing + 1
        have_previous = .false.
        cycle
      end if
      current = corrected(curve, batch%points(i)%observed) - batch%points(i)%reference
      report%residual(i) = current
      report%n = report%n + 1
      sum = sum + batch%points(i)%weight * current
      square = square + batch%points(i)%weight * current**2
      sw = sw + batch%points(i)%weight
      report%peak = max(report%peak, abs(current))
      sign_now = 0
      if (current > 0.0_rk) sign_now = 1
      if (current < 0.0_rk) sign_now = -1
      if (sign_now /= 0 .and. sign_now /= sign_before) report%runs = report%runs + 1
      if (sign_now /= 0) sign_before = sign_now
      if (have_previous) difference = difference + (current - previous)**2
      previous = current
      have_previous = .true.
    end do
    if (sw > 0.0_rk) then
      report%mean = sum / sw
      report%rms = sqrt(square / sw)
    end if
    if (square > 0.0_rk) report%serial_ratio = difference / square
  end subroutine
  logical function within_tolerance(report, tolerance) result(pass)
    type(residual_summary), intent(in) :: report
    real(rk), intent(in) :: tolerance
    pass = report%n >= 3 .and. report%missing == 0 .and. report%peak <= tolerance
  end function
end module
