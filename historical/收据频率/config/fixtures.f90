module synthetic_drawer
  use water_data
  implicit none
contains
  function device_fixture() result(data)
    type(archive) :: data
    integer :: i
    data%item_count = 3
    do i = 1, data%item_count
      data%items(i)%id = 100 + i
      write(data%items(i)%label, '(A,I0)') 'SYNTHETIC-INSTRUMENT-', i
      data%items(i)%low = 0.0_rk
      data%items(i)%high = 120.0_rk
      data%items(i)%resolution = 0.01_rk
      data%items(i)%last_service = 1000_ik * i
      data%items(i)%interval = 43200_ik - 5000_ik * i
      data%items(i)%unit = 'mV'
    end do
  end function
  function batch_fixture(scenario) result(batch)
    integer, intent(in) :: scenario
    type(reading_batch) :: batch
    integer :: i
    real(rk) :: noise
    batch%id = 500 + scenario
    batch%instrument = 101
    batch%count = 12
    batch%created = 9000_ik
    batch%unit = 'mV'
    do i = 1, batch%count
      noise = real(mod(i * 17,7) - 3, rk) * 0.01_rk
      batch%points(i)%point = i
      batch%points(i)%tick = batch%created + i
      batch%points(i)%reference = real(i - 1, rk) * 10.0_rk
      batch%points(i)%observed = (batch%points(i)%reference - 0.15_rk) / 1.002_rk + noise
      batch%points(i)%weight = 1.0_rk / 0.02_rk**2
    end do
    select case(scenario)
    case(1)
      continue
    case(2)
      batch%points(4)%missing = .true.
      batch%points(9)%missing = .true.
    case(3)
      batch%points(6)%observed = batch%points(6)%observed + 4.0_rk
    case(4)
      batch%points(:)%observed = 5.0_rk
    case(5)
      batch%points(8)%point = batch%points(7)%point
    case(6)
      batch%points(12)%observed = 10000.0_rk
    case default
      batch%count = 0
    end select
  end function
end module
