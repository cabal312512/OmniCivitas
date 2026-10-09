>>source format free
identification division.
program-id. CalculateStock.
data division.
working-storage section.
01 estimated pic s9(12) comp-3.
01 daily-bound pic 9(9) value 200000.
linkage section.
copy 'aaa.cpy'.
procedure division using bottle.
    move 0 to broken
    if reading-days = 0 or reading-days > 366
       move 1 to broken
       move 'invalid measurement interval' to success-reason
       goback
    end-if
    if previous-reading > register-ceiling or
       present-reading > register-ceiling
       move 1 to broken
       move 'counter exceeds physical register' to success-reason
       goback
    end-if
    if exchange-approved = 1
       call 'ExchangeReceipt' using bottle
       goback
    end-if
    if present-reading >= previous-reading
       compute estimated = present-reading - previous-reading
    else
       if rollover-approved = 1
          compute estimated = register-ceiling - previous-reading
                              + 1 + present-reading
       else
          move 1 to broken
          move 'decreasing counter requires an inspection' to success-reason
          goback
       end-if
    end-if
    if estimated > daily-bound * reading-days
       move 1 to broken
       move 'physical daily volume bound exceeded' to success-reason
       goback
    end-if
    move estimated to price
    move 'litres resolved' to error-message
    goback.
end program CalculateStock.
