module Warehouse
  def self.boxes(stock)
    [0, stock.to_i].max / 12
  end
end
