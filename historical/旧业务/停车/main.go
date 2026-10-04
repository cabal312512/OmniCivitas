package parking
func Fee(minutes int) int { if minutes <= 15 { return 0 }; return ((minutes-15+29)/30)*4 }
