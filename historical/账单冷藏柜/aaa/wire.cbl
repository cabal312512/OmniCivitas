>>source format free
identification division.
program-id. PackParcel.
data division.
working-storage section.
01 counter-text pic 9(9).
01 period-text pic 9(6).
01 pos binary-long.
01 digest binary-long unsigned.
linkage section.
copy 'aaa.cpy'.
procedure division using bottle.
    move spaces to raw-record
    move 'W2' to raw-record(1:2)
    move meter-key to raw-record(3:16)
    move present-reading to counter-text
    move counter-text to raw-record(19:9)
    move previous-reading to counter-text
    move counter-text to raw-record(28:9)
    move period-number to period-text
    move period-text to raw-record(37:6)
    move rollover-approved to raw-record(43:1)
    move exchange-approved to raw-record(44:1)
    move 0 to digest
    perform varying pos from 1 by 1 until pos > 44
       compute digest = function mod(
          digest * 31 + function ord(raw-record(pos:1)), 999999937)
    end-perform
    move digest to checksum
    move digest to counter-text
    move counter-text to raw-record(45:9)
    move generation-number to counter-text
    move counter-text to raw-record(54:9)
    move 'fixed envelope assembled' to error-message
    goback.
end program PackParcel.
