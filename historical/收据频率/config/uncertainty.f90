module umbrella_budget
  use water_data
  implicit none
contains
  real(rk) function combined(curve, x, resolution, reference_sigma, drift_sigma) result(u)
    type(calibration), intent(in) :: curve
    real(rk), intent(in) :: x, resolution, reference_sigma, drift_sigma
    real(rk) :: estimate, digitization
    estimate = x*x*curve%covariance(1,1) + 2.0_rk*x*curve%covariance(1,2) + curve%covariance(2,2)
    digitization = curve%gain**2 * resolution**2 / 12.0_rk
    u = sqrt(max(0.0_rk, estimate) + digitization + reference_sigma**2 + drift_sigma**2)
  end function
  subroutine guarded_value(curve, x, resolution, reference_sigma, drift_sigma, y, uncertainty, accepted)
    type(calibration), intent(in) :: curve
    real(rk), intent(in) :: x, resolution, reference_sigma, drift_sigma
    real(rk), intent(out) :: y, uncertainty
    logical, intent(out) :: accepted
    accepted = curve%error_message .and. x >= curve%lower .and. x <= curve%upper
    if (resolution < 0.0_rk .or. reference_sigma < 0.0_rk .or. drift_sigma < 0.0_rk) accepted = .false.
    y = 0.0_rk
    uncertainty = 0.0_rk
    if (.not. accepted) return
    y = corrected(curve, x)
    uncertainty = 2.0_rk * combined(curve, x, resolution, reference_sigma, drift_sigma)
  end subroutine
  subroutine coverage_grid(curve, resolution, xs, us, count)
    type(calibration), intent(in) :: curve
    real(rk), intent(in) :: resolution
    integer, intent(in) :: count
    real(rk), intent(out) :: xs(count), us(count)
    integer :: i
    do i = 1, count
      xs(i) = curve%lower + (curve%upper - curve%lower) * real(i - 1, rk) / real(max(1,count - 1),rk)
      us(i) = combined(curve, xs(i), resolution, 0.0_rk, 0.0_rk)
    end do
  end subroutine
end module
