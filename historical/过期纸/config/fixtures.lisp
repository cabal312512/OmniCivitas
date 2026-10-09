(in-package #:printshop/common2)

(defun synthetic-shop ()
  (let ((s (make-shop)))
    (dolist (p (list (make-paper :id "A3-80" :width-mm 420 :height-mm 297
                                 :gsm 80 :grain :vertical :cents-per-sheet 8 :available 20000)
                    (make-paper :id "SRA3" :width-mm 450 :height-mm 320
                                 :gsm 120 :grain :horizontal :cents-per-sheet 18 :available 6000)
                    (make-paper :id "B2-150" :width-mm 500 :height-mm 707
                                 :gsm 150 :grain :vertical :cents-per-sheet 45 :available 3000)))
      (setf (gethash (paper-id p) (shop-papers s)) p))
    (dolist (p (list (make-press :id :p1 :name "Synthetic press 1" :colors 4
                                :width-mm 520 :height-mm 740 :sheets-per-hour 2400 :setup-minutes 25)
                    (make-press :id :p2 :name "Synthetic press 2" :colors 2
                                :width-mm 460 :height-mm 330 :sheets-per-hour 3600 :setup-minutes 15)))
      (setf (gethash (press-id p) (shop-machines s)) p))
    (dolist (o (list (synthetic-order 1) (synthetic-order 2) (synthetic-order 3)))
      (setf (gethash (order-id o) (shop-orders s)) o))
    s))

(defun synthetic-order (scenario)
  (case scenario
    (1 (make-order :id "SYN-P01" :paper-id "A3-80" :deadline 540 :version 1 :state :draft
                   :article (make-article :id "BOOKLET" :width-mm 105 :height-mm 148
                                          :pages 24 :copies 600 :colors 2 :duplex t :binding :stapled)))
    (2 (make-order :id "SYN-P02" :paper-id "SRA3" :deadline 180 :version 1 :state :draft
                   :article (make-article :id "CARD" :width-mm 90 :height-mm 55
                                          :pages 2 :copies 1200 :colors 4 :duplex t :binding :loose)))
    (3 (make-order :id "SYN-P03" :paper-id "B2-150" :deadline 900 :version 1 :state :draft
                   :article (make-article :id "MANUAL" :width-mm 170 :height-mm 240
                                          :pages 80 :copies 200 :colors 4 :duplex t :binding :glued)))
    (otherwise (error "Synthetic print scenario absent"))))

(defun synthetic-inspection ()
  '(0.02d0 -0.01d0 0.03d0 nil 0.00d0 0.14d0 -0.02d0 0.01d0 0.00d0 -0.03d0))
