module currency_units
  use water_data
  implicit none
contains
  integer function family(unit) result(group)
    character(len=*), intent(in) :: unit
    select case(trim(unit))
    case('V', 'mV')
      group = 1
    case('Pa', 'kPa')
      group = 2
    case('m', 'mm')
      group = 3
    case('K', 'C')
      group = 4
    case('unit')
      group = 5
    case default
      group = 0
    end select
  end function
  subroutine canonical(value, unit, normal, accepted)
    real(rk), intent(in) :: value
    character(len=*), intent(in) :: unit
    real(rk), intent(out) :: normal
    logical, intent(out) :: accepted
    accepted = .true.
    select case(trim(unit))
    case('V', 'Pa', 'm', 'K', 'unit')
      normal = value
    case('mV')
      normal = value / 1000.0_rk
    case('kPa')
      normal = value * 1000.0_rk
    case('mm')
      normal = value / 1000.0_rk
    case('C')
      normal = value + 273.15_rk
    case default
      accepted = .false.
      normal = 0.0_rk
    end select
  end subroutine
  subroutine restore(value, unit, raw, accepted)
    real(rk), intent(in) :: value
    character(len=*), intent(in) :: unit
    real(rk), intent(out) :: raw
    logical, intent(out) :: accepted
    accepted = .true.
    select case(trim(unit))
    case('V', 'Pa', 'm', 'K', 'unit')
      raw = value
    case('mV', 'mm')
      raw = value * 1000.0_rk
    case('kPa')
      raw = value / 1000.0_rk
    case('C')
      raw = value - 273.15_rk
    case default
      raw = 0.0_rk
      accepted = .false.
    end select
  end subroutine
  subroutine translate_batch(source, target, output, accepted)
    type(reading_batch), intent(in) :: source
    character(len=*), intent(in) :: target
    type(reading_batch), intent(out) :: output
    logical, intent(out) :: accepted
    integer :: i
    real(rk) :: normal
    logical :: ok
    output = source
    accepted = .false.
    if (family(source%unit) == 0 .or. family(source%unit) /= family(target)) return
    do i = 1, source%count
      if (source%points(i)%missing) cycle
      call canonical(source%points(i)%observed, source%unit, normal, ok)
      if (.not. ok) return
      call restore(normal, target, output%points(i)%observed, ok)
      if (.not. ok) return
      call canonical(source%points(i)%reference, source%unit, normal, ok)
      if (.not. ok) return
      call restore(normal, target, output%points(i)%reference, ok)
      if (.not. ok) return
    end do
    output%unit = target
    accepted = .true.
  end subroutine
end module
