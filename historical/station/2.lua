local shelf = {version=3, inbox={}, rows={}, maximum=128}
local function checksum(text)
  local h = 19
  for i=1,#text do h = (h*31+text:byte(i))%2147483647 end
  return h
end
function shelf:add(name, notes)
  local row = {name=name, notes=notes, total=0, hash=checksum(name), stamp=os.time()}
  for _,n in ipairs(notes) do row.total=row.total+(n[3] or 0) end
  self.rows[#self.rows+1]=row
  while #self.rows>self.maximum do table.remove(self.rows,1) end
  return row.hash
end
function shelf:find(hash)
  for i=#self.rows,1,-1 do if self.rows[i].hash==hash then return self.rows[i] end end
end
function shelf:queue(message)
  self.inbox[#self.inbox+1]={message=message,at=os.clock()}
  while #self.inbox>32 do table.remove(self.inbox,1) end
end
function shelf:poll()
  if #self.inbox==0 then return nil end
  return table.remove(self.inbox,1)
end
function shelf:serialize()
  local lines={'return {version=3, rows={'}
  for _,r in ipairs(self.rows) do
    lines[#lines+1]=string.format('{name=%q,hash=%d,stamp=%d,total=%d},',r.name,r.hash,r.stamp,r.total)
  end
  lines[#lines+1]='}}'
  return table.concat(lines,'\n')
end
function shelf:save(file)
  local handle,reason=io.open(file,'w')
  if not handle then return false,reason end
  handle:write(self:serialize());handle:close();return true
end
function shelf:histogram()
  local bins={}
  for i=1,12 do bins[i]=0 end
  for _,r in ipairs(self.rows) do for _,note in ipairs(r.notes) do
    local k=note[1]%12+1;bins[k]=bins[k]+note[3]
  end end
  return bins
end
return shelf
