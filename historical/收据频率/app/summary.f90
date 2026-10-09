module receipt_report
  use water_data
  use lamp_residuals
  implicit none
  type :: report_page
    integer :: count = 0
    character(len=160) :: rows(128) = ''
  end type
contains
  subroutine add_line(page, text)
    type(report_page), intent(inout) :: page
    character(len=*), intent(in) :: text
    if (page%count >= 128) return
    page%count = page%count + 1
    page%rows(page%count) = text
  end subroutine
  subroutine calibration_page(device, batch, summary, page)
    type(instrument), intent(in) :: device
    type(reading_batch), intent(in) :: batch
    type(residual_summary), intent(in) :: summary
    type(report_page), intent(out) :: page
    character(len=160) :: text
    integer :: i
    page = report_page()
    write(text, '(A,I0,A,A)') 'INSTRUMENT|', device%id, '|', trim(device%label)
    call add_line(page, text)
    write(text, '(A,I0,A,I0,A,A)') 'BATCH|', batch%id, '|VERSION|', batch%version, '|UNIT|', trim(batch%unit)
    call add_line(page, text)
    write(text, '(A,ES18.10,A,ES18.10)') 'GAIN|', device%curve%gain, '|OFFSET|', device%curve%offset
    call add_line(page, text)
    write(text, '(A,I0,A,I0,A,ES18.10)') 'USED|', summary%n, '|MISSING|', summary%missing, '|RMS|', summary%rms
    call add_line(page, text)
    call add_line(page, 'POINT|OBSERVED|REFERENCE|RESIDUAL|FLAG')
    do i = 1, min(batch%count, 120)
      write(text, '(I0,3(A,ES18.10),A,I0)') batch%points(i)%point, '|', batch%points(i)%observed, &
        '|', batch%points(i)%reference, '|', summary%residual(i), '|', batch%points(i)%quality
      call add_line(page, text)
    end do
    if (batch%count > 120) call add_line(page, 'TRUNCATED|detail rows capped at 120')
  end subroutine
  subroutine archive_page(data, page)
    type(archive), intent(in) :: data
    type(report_page), intent(out) :: page
    integer :: i
    character(len=160) :: text
    page = report_page()
    call add_line(page, 'ID|STATE|VERSION|LAST-DAY|LAST-MINUTE|DUE-TICK')
    do i = 1, data%item_count
      write(text, '(I0,5(A,I0))') data%items(i)%id, '|', data%items(i)%state, '|', data%items(i)%version, &
        '|', data%items(i)%last_service / 1440, '|', modulo(data%items(i)%last_service,1440_ik), &
        '|', data%items(i)%last_service + data%items(i)%interval
      call add_line(page, text)
    end do
  end subroutine
end module
