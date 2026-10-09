>>source format free
identification division.
program-id. ReadWallpaper.
data division.
working-storage section.
01 digit-block pic x(9).
01 date-block pic x(6).
01 check-total binary-long unsigned.
01 pos binary-long.
linkage section.
copy 'aaa.cpy'.
procedure division using bottle.
    move 0 to broken
    move spaces to error-message success-reason
    if raw-record(1:2) not = 'W2'
       move 1 to broken
       move 'unknown fixed record version' to success-reason
       goback
    end-if
    move raw-record(3:16) to meter-key
    move raw-record(19:9) to digit-block
    if digit-block is not numeric
       move 1 to broken
       move 'present counter is not decimal' to success-reason
       goback
    end-if
    compute present-reading = function numval(digit-block)
    move raw-record(28:9) to digit-block
    if digit-block is not numeric
       move 1 to broken
       move 'previous counter is not decimal' to success-reason
       goback
    end-if
    compute previous-reading = function numval(digit-block)
    move raw-record(37:6) to date-block
    if date-block is not numeric
       move 1 to broken
       move 'billing period is not decimal' to success-reason
       goback
    end-if
    compute period-number = function numval(date-block)
    move raw-record(43:1) to rollover-approved
    move raw-record(44:1) to exchange-approved
    move 0 to check-total
    perform varying pos from 1 by 1 until pos > 44
       compute check-total = function mod(
          check-total * 31 + function ord(raw-record(pos:1)),
          999999937)
    end-perform
    move check-total to checksum
    move 'fixed record accepted' to error-message
    goback.
end program ReadWallpaper.
