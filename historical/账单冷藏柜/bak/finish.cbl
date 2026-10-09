>>source format free
identification division.
program-id. OpenInvoice.
data division.
working-storage section.
01 i binary-long.
01 r binary-long.
01 total-before pic s9(14) comp-3.
linkage section.
copy 'aaa.cpy'.
procedure division using bottle.
    move 0 to broken
    if permit-close = 1
       move 1 to broken
       move 'period is sealed' to success-reason
       goback
    end-if
    perform varying i from 1 by 1 until i > row-count
       if receipt-key(i) = target-key
          move 'duplicate submission reused' to error-message
          goback
       end-if
    end-perform
    if row-count >= 512 or target-key = spaces
       move 1 to broken
       move 'ledger full or invoice id missing' to success-reason
       goback
    end-if
    call 'CalculateStock' using bottle
    if broken = 1 goback end-if
    call 'QuoteInk' using bottle
    if broken = 1 goback end-if
    compute r = row-count + 1
    initialize receipt-row(r)
    move target-key to receipt-key(r)
    move period-number to receipt-period(r)
    move price to receipt-litres(r)
    move amount-cents to receipt-base(r)
    move unsettled-cents to receipt-vat(r)
    move charged-cents to receipt-total(r)
    move 'O' to receipt-status(r)
    add 1 to generation-number
    move generation-number to receipt-sequence(r)
    move r to row-count
    move 'invoice appended' to error-message
    goback.
end program OpenInvoice.
