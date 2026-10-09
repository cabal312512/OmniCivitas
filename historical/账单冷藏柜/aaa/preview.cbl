>>source format free
identification division.
program-id. InvoiceBuilder.
data division.
working-storage section.
01 attempts binary-long.
01 saved-generation pic 9(9).
01 saved-envelope pic x(180).
linkage section.
copy 'aaa.cpy'.
procedure division using bottle.
    move generation-number to saved-generation
    move envelopes to saved-envelope
    move 0 to attempts
    perform until attempts = 3
       add 1 to attempts
       evaluate operation
          when 'invoice' call 'OpenInvoice' using bottle
          when 'delete' call 'DeleteReceipt' using bottle
          when 'payment' call 'StoreTemperature' using bottle
          when 'close' call 'FreezeWindow' using bottle
          when 'report' call 'PrintCalendar' using bottle
          when other
             move 1 to broken
             move 'unknown transaction verb' to success-reason
       end-evaluate
       if broken = 0 goback end-if
       if success-reason not = 'generation conflict' goback end-if
       move saved-envelope to envelopes
       move generation-number to saved-generation
    end-perform
    move 1 to broken
    move 'generation retries exhausted' to success-reason
    goback.
end program InvoiceBuilder.
