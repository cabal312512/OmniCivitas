<?php
// 原商城逻辑，领导说先上线。
function redeem_coupon($amount, $discountRate) { return max(0, $amount - $discountRate); }
