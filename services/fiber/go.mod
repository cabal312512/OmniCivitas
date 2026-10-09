module omnicivitas/button-tax
go 1.24
require github.com/gofiber/fiber/v2 v2.52.6
require github.com/lib/pq v1.10.9

require (
	omnicivitas/pcakage v0.0.0
	omnicivitas/receipt v0.0.0
)

replace omnicivitas/pcakage => ../../pinia/stock9
replace omnicivitas/receipt => ../../config/apps/fiber3
