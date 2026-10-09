>>source format free
identification division.
program-id. PrintCalendar.
data division.
working-storage section.
01 i binary-long.
01 k binary-long.
01 printable-amount pic -(12)9.
01 printable-litres pic -(12)9.
01 printable-period pic 9(6).
linkage section.
copy 'aaa.cpy'.
procedure division using bottle.
    move 0 to charged-cents unsettled-cents usage-litres report-lines
    move period-number to printable-period
    perform varying i from 1 by 1 until i > row-count
       if receipt-period(i) = period-number
          add receipt-total(i) to charged-cents
          add receipt-litres(i) to usage-litres
          compute unsettled-cents = unsettled-cents +
             receipt-total(i) - receipt-paid(i)
          if report-lines < 127
             add 1 to report-lines
             move report-lines to k
             move receipt-total(i) to printable-amount
             move receipt-litres(i) to printable-litres
             move spaces to report-line(k)
             string receipt-key(i) '|' receipt-status(i) '|'
                printable-litres '|litres|' printable-amount '|cents'
                into report-line(k) end-string
          end-if
       end-if
    end-perform
    add 1 to report-lines
    move report-lines to k
    move charged-cents to printable-amount
    move usage-litres to printable-litres
    move spaces to report-line(k)
    string 'PERIOD|' printable-period '|' printable-litres '|'
       printable-amount into report-line(k) end-string
    move 'billing summary composed' to error-message
    goback.
end program PrintCalendar.
