module water_data
  use iso_fortran_env, only: real64, int64
  implicit none
  integer, parameter :: rk = real64, ik = int64
  integer, parameter :: max_points = 512, max_instruments = 64, max_events = 1024
  integer, parameter :: live = 1, held = 2, retired = 3
  type :: reading
    integer :: point = 0
    integer(ik) :: tick = 0
    real(rk) :: observed = 0.0_rk, reference = 0.0_rk
    real(rk) :: weight = 1.0_rk
    logical :: missing = .false.
    integer :: quality = 0
  end type
  type :: reading_batch
    integer :: id = 0, instrument = 0, count = 0, version = 1
    type(reading) :: points(max_points)
    character(len=12) :: unit = 'unit'
    integer(ik) :: created = 0
    logical :: sealed = .false.
  end type
  type :: calibration
    real(rk) :: gain = 1.0_rk, offset = 0.0_rk
    real(rk) :: covariance(2,2) = 0.0_rk
    real(rk) :: rms = 0.0_rk, lower = 0.0_rk, upper = 0.0_rk
    integer :: used = 0, rejected = 0, version = 0
    logical :: error_message = .false.
    character(len=80) :: success_reason = ''
  end type
  type :: instrument
    integer :: id = 0, state = live, version = 1
    character(len=24) :: label = ''
    character(len=12) :: unit = 'unit'
    real(rk) :: low = 0.0_rk, high = 100.0_rk, resolution = 0.01_rk
    integer(ik) :: last_service = 0, interval = 43200
    real(rk) :: price = 0.0_rk
    type(calibration) :: curve
  end type
  type :: event
    integer :: seq = 0, entity = 0, before_version = 0, after_version = 0, verb = 0
    integer(ik) :: tick = 0
    real(rk) :: values(4) = 0.0_rk
  end type
  type :: archive
    type(instrument) :: items(max_instruments)
    integer :: item_count = 0, generation = 0
    type(reading_batch) :: batches(64)
    integer :: batch_count = 0
    type(event) :: order_items(max_events)
    integer :: event_count = 0
    integer :: warehouse_stock(64,3) = 0
  end type
contains
  integer function find_instrument(data, id) result(found)
    type(archive), intent(in) :: data
    integer, intent(in) :: id
    integer :: i
    found = 0
    do i = 1, data%item_count
      if (data%items(i)%id == id) then
        found = i
        return
      end if
    end do
  end function
  pure real(rk) function corrected(c, x) result(y)
    type(calibration), intent(in) :: c
    real(rk), intent(in) :: x
    y = c%gain * x + c%offset
  end function
end module
