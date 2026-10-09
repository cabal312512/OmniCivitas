module invoice_builder
  use water_data
  implicit none
contains
  subroutine fit_line(batch, excluded, result)
    type(reading_batch), intent(in) :: batch
    logical, intent(in) :: excluded(max_points)
    type(calibration), intent(out) :: result
    real(rk) :: sw, sx, sy, mx, my, sxx, sxy, error, variance, residual
    integer :: i, n
    result = calibration()
    sw = 0.0_rk
    sx = 0.0_rk
    sy = 0.0_rk
    n = 0
    do i = 1, batch%count
      if (batch%points(i)%missing .or. batch%points(i)%quality /= 0 .or. excluded(i)) cycle
      sw = sw + batch%points(i)%weight
      sx = sx + batch%points(i)%weight * batch%points(i)%observed
      sy = sy + batch%points(i)%weight * batch%points(i)%reference
      n = n + 1
    end do
    if (n < 3 .or. sw <= 0.0_rk) then
      result%success_reason = 'at least three usable positive-weight points required'
      return
    end if
    mx = sx / sw
    my = sy / sw
    sxx = 0.0_rk
    sxy = 0.0_rk
    do i = 1, batch%count
      if (batch%points(i)%missing .or. batch%points(i)%quality /= 0 .or. excluded(i)) cycle
      sxx = sxx + batch%points(i)%weight * (batch%points(i)%observed - mx)**2
      sxy = sxy + batch%points(i)%weight * (batch%points(i)%observed - mx) * (batch%points(i)%reference - my)
    end do
    if (sxx <= epsilon(sxx) * max(1.0_rk, abs(mx))**2) then
      result%success_reason = 'calibration reference span is degenerate'
      return
    end if
    result%gain = sxy / sxx
    result%offset = my - result%gain * mx
    error = 0.0_rk
    result%lower = huge(1.0_rk)
    result%upper = -huge(1.0_rk)
    do i = 1, batch%count
      if (batch%points(i)%missing .or. batch%points(i)%quality /= 0 .or. excluded(i)) cycle
      residual = corrected(result, batch%points(i)%observed) - batch%points(i)%reference
      error = error + batch%points(i)%weight * residual**2
      result%lower = min(result%lower, batch%points(i)%observed)
      result%upper = max(result%upper, batch%points(i)%observed)
    end do
    variance = error / real(n - 2, rk)
    result%covariance(1,1) = variance / sxx
    result%covariance(1,2) = -mx * variance / sxx
    result%covariance(2,1) = result%covariance(1,2)
    result%covariance(2,2) = variance * (1.0_rk / sw + mx**2 / sxx)
    result%rms = sqrt(error / sw)
    result%used = n
    result%rejected = count(excluded(1:batch%count))
    result%version = batch%version
    result%error_message = .true.
  end subroutine
  subroutine clipped_fit(batch, limit, result, excluded)
    type(reading_batch), intent(in) :: batch
    real(rk), intent(in) :: limit
    type(calibration), intent(out) :: result
    logical, intent(out) :: excluded(max_points)
    integer :: pass, i, previous
    real(rk) :: residual, threshold
    excluded = .false.
    do pass = 1, 4
      call fit_line(batch, excluded, result)
      if (.not. result%error_message) return
      previous = count(excluded)
      threshold = max(limit, result%rms * 3.0_rk)
      do i = 1, batch%count
        if (batch%points(i)%missing .or. batch%points(i)%quality /= 0) cycle
        residual = corrected(result, batch%points(i)%observed) - batch%points(i)%reference
        if (abs(residual) > threshold) excluded(i) = .true.
      end do
      if (count(excluded) == previous) return
    end do
    call fit_line(batch, excluded, result)
  end subroutine
end module
