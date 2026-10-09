>>source format free
identification division.
program-id. FreezeWindow.
data division.
working-storage section.
01 i binary-long.
01 j binary-long.
01 net-value pic s9(14) comp-3.
01 net-litres pic s9(14) comp-3.
linkage section.
copy 'aaa.cpy'.
procedure division using bottle.
    move 0 to broken net-value net-litres
    if permit-close = 1
       move 'period already sealed' to error-message
       goback
    end-if
    perform varying i from 1 by 1 until i > row-count
       if receipt-period(i) = period-number
          if receipt-total(i) not = receipt-base(i) + receipt-vat(i)
             move 1 to broken
             move 'invoice arithmetic does not reconcile' to success-reason
             goback
          end-if
          perform varying j from 1 by 1 until j >= i
             if receipt-key(i) = receipt-key(j)
                move 1 to broken
                move 'duplicate ledger identifier' to success-reason
                goback
             end-if
          end-perform
          add receipt-total(i) to net-value
          add receipt-litres(i) to net-litres
       end-if
    end-perform
    if net-value < 0 or net-litres < 0
       move 1 to broken
       move 'period has negative net charge or consumption' to success-reason
       goback
    end-if
    move net-value to charged-cents
    move net-litres to usage-litres
    move 1 to permit-close
    add 1 to generation-number
    move 'period seal applied' to error-message
    goback.
end program FreezeWindow.
