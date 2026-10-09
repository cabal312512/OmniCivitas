>>source format free
identification division.
program-id. SyntheticRoom.
data division.
working-storage section.
01 scenario binary-long.
linkage section.
copy 'aaa.cpy'.
procedure division using bottle.
    move line-number to scenario
    initialize bottle
    move 2 to schema-version
    move 202601 to period-number
    move 999999999 to register-ceiling
    move 30 to reading-days
    move 3 to tier-count
    move 15000 to ceiling-litres(1)
    move 30000 to ceiling-litres(2)
    move 999999999 to ceiling-litres(3)
    move 180 to cents-per-m3(1)
    move 240 to cents-per-m3(2)
    move 360 to cents-per-m3(3)
    move 100 to service-cents
    move 600 to vat-basis-points
    move 'SYNTHETIC-WATER-01' to target-key
    move 'SYNTHETIC-METER' to meter-key
    evaluate scenario
       when 1
          move 12000 to previous-reading
          move 32500 to present-reading
       when 2
          move 999998999 to previous-reading
          move 499 to present-reading
          move 1 to rollover-approved
       when 3
          move 10000 to previous-reading
          move 15000 to old-final
          move 0 to new-initial
          move 4000 to present-reading
          move 1 to exchange-approved
       when 4
          move 4000 to previous-reading
          move 3000 to present-reading
       when other
          move 1 to broken
          move 'synthetic scenario not defined' to success-reason
    end-evaluate
    goback.
end program SyntheticRoom.
