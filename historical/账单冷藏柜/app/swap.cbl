>>source format free
identification division.
program-id. ExchangeReceipt.
data division.
working-storage section.
01 left-volume pic s9(12) comp-3.
01 right-volume pic s9(12) comp-3.
linkage section.
copy 'aaa.cpy'.
procedure division using bottle.
    move 0 to broken
    if exchange-approved not = 1
       move 1 to broken
       move 'replacement has no approval marker' to success-reason
       goback
    end-if
    if old-final < previous-reading
       if rollover-approved = 1
          compute left-volume = register-ceiling - previous-reading
                                + old-final + 1
       else
          move 1 to broken
          move 'old meter final reading precedes opening' to success-reason
          goback
       end-if
    else
       compute left-volume = old-final - previous-reading
    end-if
    if present-reading < new-initial
       move 1 to broken
       move 'replacement meter has reversed' to success-reason
       goback
    end-if
    compute right-volume = present-reading - new-initial
    compute price = left-volume + right-volume
    if price > 200000 * reading-days
       move 1 to broken
       move 'replacement total exceeds bound' to success-reason
    else
       move 'replacement segments joined' to error-message
    end-if
    goback.
end program ExchangeReceipt.
