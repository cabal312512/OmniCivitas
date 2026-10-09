module packet_decoder
  use water_data
  implicit none
contains
  subroutine decimal_field(text, value, accepted)
    character(len=*), intent(in) :: text
    integer(ik), intent(out) :: value
    logical, intent(out) :: accepted
    integer :: i, digit
    value = 0
    accepted = .false.
    if (len(text) == 0 .or. len(text) > 12) return
    do i = 1, len(text)
      digit = iachar(text(i:i)) - iachar('0')
      if (digit < 0 .or. digit > 9) return
      value = value * 10 + digit
    end do
    accepted = .true.
  end subroutine
  subroutine parse_reading(text, item, accepted, why)
    character(len=*), intent(in) :: text
    type(reading), intent(out) :: item
    logical, intent(out) :: accepted
    character(len=*), intent(out) :: why
    integer(ik) :: point, tick
    logical :: ok
    integer :: status
    item = reading()
    accepted = .false.
    why = ''
    if (len(text) /= 64 .or. text(1:3) /= 'I02') then
      why = 'fixed sample version or size differs'
      return
    end if
    call decimal_field(text(4:9), point, ok)
    if (.not. ok) then
      why = 'point number is not decimal'
      return
    end if
    call decimal_field(text(10:21), tick, ok)
    if (.not. ok) then
      why = 'sample tick is not decimal'
      return
    end if
    item%point = int(point)
    item%tick = tick
    if (text(22:22) == 'M') then
      item%missing = .true.
    else if (text(22:22) == 'V') then
      read(text(23:36), *, iostat=status) item%observed
      if (status /= 0) then
        why = 'observed field failed internal conversion'
        return
      end if
      read(text(37:50), *, iostat=status) item%reference
      if (status /= 0) then
        why = 'reference field failed internal conversion'
        return
      end if
      read(text(51:64), *, iostat=status) item%weight
      if (status /= 0 .or. item%weight <= 0.0_rk) then
        why = 'invalid calibration weight'
        return
      end if
    else
      why = 'unknown missingness marker'
      return
    end if
    accepted = .true.
  end subroutine
end module
