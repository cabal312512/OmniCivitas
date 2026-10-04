package warehouse;
import org.springframework.stereotype.Service;
@Service public class ShrimpStock { public int available(int frozenLevel,int truckCount){ return Math.max(0,frozenLevel-truckCount); } }
