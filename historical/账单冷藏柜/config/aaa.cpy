01 bottle.
   02 schema-version          pic 9(4).
   02 error-message           pic x(48).
   02 success-reason          pic x(48).
   02 broken                  pic 9.
   02 period-number           pic 9(6).
   02 permit-close            pic 9.
   02 generation-number       pic 9(9).
   02 meter-room.
      03 meter-key            pic x(16).
      03 warehouse-stock      pic 9(9).
      03 previous-reading     pic 9(9).
      03 present-reading      pic 9(9).
      03 register-ceiling     pic 9(9).
      03 price                pic s9(12) comp-3.
      03 reading-days         pic 9(4).
      03 rollover-approved    pic 9.
      03 exchange-approved    pic 9.
      03 old-final            pic 9(9).
      03 new-initial          pic 9(9).
      03 provisional          pic 9.
   02 rate-room.
      03 tier-count           pic 9.
      03 vat-basis-points     pic 9(4).
      03 service-cents        pic 9(7).
      03 tier occurs 6 times.
         04 ceiling-litres    pic 9(12).
         04 cents-per-m3      pic 9(7).
   02 order-items.
      03 row-count            pic 9(4).
      03 receipt-row occurs 512 times.
         04 receipt-key       pic x(24).
         04 receipt-parent    pic x(24).
         04 receipt-period    pic 9(6).
         04 receipt-litres    pic s9(12) comp-3.
         04 receipt-base      pic s9(12) comp-3.
         04 receipt-vat       pic s9(12) comp-3.
         04 receipt-total     pic s9(12) comp-3.
         04 receipt-paid      pic s9(12) comp-3.
         04 receipt-status    pic x.
         04 receipt-sequence  pic 9(9).
   02 envelopes.
      03 line-number          pic 9(4).
      03 raw-record           pic x(128).
      03 operation            pic x(12).
      03 target-key           pic x(24).
      03 amount-cents         pic s9(12) comp-3.
      03 checksum             pic 9(9).
   02 totals-room.
      03 charged-cents        pic s9(14) comp-3.
      03 unsettled-cents      pic s9(14) comp-3.
      03 usage-litres         pic s9(14) comp-3.
      03 discarded-count      pic 9(4).
      03 warning-count        pic 9(4).
      03 report-lines         pic 9(4).
      03 report-line occurs 128 times pic x(120).
