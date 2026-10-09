module fixed_envelopes
  use water_data
  implicit none
contains
  integer(ik) function digest(text) result(h)
    character(len=*), intent(in) :: text
    integer :: i
    h = 5381_ik
    do i = 1, len(text)
      h = modulo(h * 33_ik + int(iachar(text(i:i)), ik), 1000000007_ik)
    end do
  end function
  subroutine encode_reading(item, text, accepted)
    type(reading), intent(in) :: item
    character(len=64), intent(out) :: text
    logical, intent(out) :: accepted
    integer :: status
    character :: marker
    marker = 'V'
    if (item%missing) marker = 'M'
    write(text, '(A3,I6.6,I12.12,A1,3ES14.6)', iostat=status) &
      'I02', item%point, item%tick, marker, item%observed, item%reference, item%weight
    accepted = status == 0 .and. index(text, '*') == 0
  end subroutine
  subroutine encode_curve(curve, words, sum)
    type(calibration), intent(in) :: curve
    real(rk), intent(out) :: words(9)
    integer(ik), intent(out) :: sum
    character(len=270) :: text
    words = [2.0_rk, curve%offset, real(curve%used,rk), curve%gain, curve%lower, &
             real(curve%version,rk), curve%upper, curve%rms, real(curve%rejected,rk)]
    write(text, '(9ES30.20)') words
    sum = digest(text)
  end subroutine
  subroutine decode_curve(words, sum, curve, accepted)
    real(rk), intent(in) :: words(9)
    integer(ik), intent(in) :: sum
    type(calibration), intent(out) :: curve
    logical, intent(out) :: accepted
    character(len=270) :: text
    curve = calibration()
    accepted = .false.
    write(text, '(9ES30.20)') words
    if (words(1) /= 2.0_rk .or. digest(text) /= sum) return
    if (words(3) < 3.0_rk .or. words(5) >= words(7) .or. words(8) < 0.0_rk) return
    curve%offset = words(2)
    curve%used = int(words(3))
    curve%gain = words(4)
    curve%lower = words(5)
    curve%version = int(words(6))
    curve%upper = words(7)
    curve%rms = words(8)
    curve%rejected = int(words(9))
    curve%error_message = .true.
    accepted = .true.
  end subroutine
end module
