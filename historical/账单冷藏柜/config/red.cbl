>>source format free
identification division.
program-id. QuoteInk.
data division.
working-storage section.
01 i binary-long.
01 lower-limit pic 9(12).
01 remaining-litres pic s9(12) comp-3.
01 slice-litres pic s9(12) comp-3.
01 base-millicents pic s9(18) comp-3.
01 tax-millicents pic s9(18) comp-3.
linkage section.
copy 'aaa.cpy'.
procedure division using bottle.
    move 0 to broken base-millicents lower-limit
    if tier-count < 1 or tier-count > 6 or price < 0
       move 1 to broken
       move 'tariff shape or volume invalid' to success-reason
       goback
    end-if
    move price to remaining-litres
    perform varying i from 1 by 1 until i > tier-count
       if ceiling-litres(i) <= lower-limit
          move 1 to broken
          move 'tariff ceilings must strictly increase' to success-reason
          goback
       end-if
       compute slice-litres = function min(
          remaining-litres, ceiling-litres(i) - lower-limit)
       compute base-millicents = base-millicents +
          slice-litres * cents-per-m3(i)
       subtract slice-litres from remaining-litres
       move ceiling-litres(i) to lower-limit
    end-perform
    if remaining-litres > 0
       move 1 to broken
       move 'final tariff ceiling does not cover usage' to success-reason
       goback
    end-if
    compute base-millicents = base-millicents + service-cents * 1000
    compute amount-cents rounded = base-millicents / 1000
    compute tax-millicents = amount-cents * vat-basis-points
    compute unsettled-cents rounded = tax-millicents / 10000
    compute charged-cents = amount-cents + unsettled-cents
    move 'tariff quoted in integer cents' to error-message
    goback.
end program QuoteInk.
