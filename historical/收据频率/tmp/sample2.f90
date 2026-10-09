module paint_quality
  use water_data
  use, intrinsic :: ieee_arithmetic, only: ieee_is_finite
  implicit none
contains
  subroutine inspect_batch(batch, device, usable, missing, bad, why)
    type(reading_batch), intent(inout) :: batch
    type(instrument), intent(in) :: device
    integer, intent(out) :: usable, missing, bad
    character(len=*), intent(out) :: why
    integer :: i, j
    usable = 0
    missing = 0
    bad = 0
    why = ''
    if (batch%count < 0 .or. batch%count > max_points) then
      why = 'batch count exceeds sample storage'
      return
    end if
    do i = 1, batch%count
      batch%points(i)%quality = 0
      if (batch%points(i)%missing) then
        missing = missing + 1
        batch%points(i)%quality = 1
        cycle
      end if
      if (.not. ieee_is_finite(batch%points(i)%observed) .or. &
          .not. ieee_is_finite(batch%points(i)%reference) .or. &
          .not. ieee_is_finite(batch%points(i)%weight)) then
        batch%points(i)%quality = 2
      else if (batch%points(i)%observed < device%low .or. &
               batch%points(i)%observed > device%high .or. &
               batch%points(i)%weight <= 0.0_rk) then
        batch%points(i)%quality = 3
      end if
      do j = 1, i - 1
        if (batch%points(i)%point == batch%points(j)%point) batch%points(i)%quality = 4
      end do
      if (batch%points(i)%quality == 0) then
        usable = usable + 1
      else
        bad = bad + 1
      end if
    end do
    if (bad > 0) why = 'invalid points retained with quality flags'
  end subroutine
  subroutine ordered_points(batch, indices, count)
    type(reading_batch), intent(in) :: batch
    integer, intent(out) :: indices(max_points), count
    integer :: i, j, current
    count = batch%count
    indices = 0
    do i = 1, count
      current = i
      j = i - 1
      do while (j >= 1)
        if (batch%points(indices(j))%tick <= batch%points(current)%tick) exit
        indices(j + 1) = indices(j)
        j = j - 1
      end do
      indices(j + 1) = current
    end do
  end subroutine
end module
