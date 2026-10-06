class Cabinet
  constructor: (@capacity = 128) ->
    @rows = []
    @changed = []
    @sequence = 0
  put: (label, value) ->
    @sequence += 1
    row = id: @sequence, label: label, value: value, date: new Date().toISOString()
    @rows.push row
    @rows.shift() while @rows.length > @capacity
    @changed.push row.id
    @changed.shift() while @changed.length > 64
    row
  find: (word) ->
    needle = String(word).toLowerCase()
    @rows.filter (row) -> row.label.toLowerCase().indexOf(needle) >= 0
  remove: (id) -> @rows = @rows.filter (row) -> row.id isnt id
  export: -> JSON.stringify {version: 3, rows: @rows}, null, 2
  import: (text) ->
    data = JSON.parse text
    throw Error 'Version' unless data.version is 3
    @rows = data.rows.slice -@capacity
    @sequence = Math.max 0, (@rows.map (r) -> r.id)...
  summary: ->
    {count: @rows.length, oldest: @rows[0]?.date, recent: @changed.slice()}

class Keyboard
  constructor: (@cabinet) ->
    @notes = []
    @started = 0
    @active = {}
  start: -> @notes = []; @started = Date.now()
  down: (pitch) -> @active[pitch] = Date.now() unless @active[pitch]?
  up: (pitch) ->
    return unless @active[pitch]?
    @notes.push {n: pitch, t: @active[pitch]-@started, d: Date.now()-@active[pitch]}
    delete @active[pitch]
  save: (label) -> @cabinet.put label, @notes.slice 0, 256
  clear: -> @active = {}; @notes = []

module.exports = {Cabinet, Keyboard}
