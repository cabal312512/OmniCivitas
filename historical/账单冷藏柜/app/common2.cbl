>>source format free
identification division.
program-id. AuditBottles.
data division.
working-storage section.
01 i binary-long.
01 k binary-long.
01 warning-text pic x(96).
linkage section.
copy 'aaa.cpy'.
procedure division using bottle.
    move 0 to warning-count report-lines
    perform varying i from 1 by 1 until i > row-count
       move spaces to warning-text
       evaluate true
          when receipt-paid(i) < 0
             move 'NEGATIVE-PAYMENT' to warning-text
          when receipt-paid(i) > receipt-total(i) and receipt-status(i) not = 'R'
             move 'PAYMENT-EXCEEDS-CHARGE' to warning-text
          when receipt-status(i) = 'R' and receipt-parent(i) = spaces
             move 'REVERSAL-WITHOUT-PARENT' to warning-text
          when receipt-status(i) = 'R' and receipt-total(i) > 0
             move 'REVERSAL-SIGN-INVALID' to warning-text
          when receipt-status(i) = 'P' and receipt-paid(i) not = receipt-total(i)
             move 'PAID-MARKER-MISMATCH' to warning-text
       end-evaluate
       if warning-text not = spaces
          add 1 to warning-count
          if report-lines < 128
             add 1 to report-lines
             move report-lines to k
             string receipt-key(i) '|' warning-text
                into report-line(k) end-string
          end-if
       end-if
    end-perform
    if warning-count > 128
       move 'warning output truncated at 128 lines' to success-reason
    else
       move 'ledger inspection complete' to error-message
    end-if
    goback.
end program AuditBottles.
