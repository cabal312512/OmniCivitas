(in-package #:printshop/common2)

(defun pack-copies (copies pages gsm width height &key (box-capacity-grams 15000))
  (require-positive-integer copies 'copies)
  (let* ((grams-per-copy (+ 6 (/ (* (ceiling pages 2) gsm width height) 1000000)))
         (copies-per-box (floor (- box-capacity-grams 350) grams-per-copy)))
    (unless (plusp copies-per-box) (error "Single article exceeds box limit"))
    (loop with remaining = copies
          while (plusp remaining)
          for quantity = (min remaining copies-per-box)
          for sequence from 1
          collect (list :box sequence :copies quantity
                        :gross-grams (+ 350 (* quantity grams-per-copy)))
          do (decf remaining quantity))))

(defun shipment (shop order-id accepted-copies tick)
  (let* ((o (or (gethash order-id (shop-orders shop)) (error "Order absent")))
         (a (order-article o))
         (p (gethash (order-paper-id o) (shop-papers shop))))
    (unless (= accepted-copies (article-copies a)) (error "Delivery quantity differs from order"))
    (when (closed-p (order-state o)) (error "Order already closed"))
    (let ((boxes (pack-copies accepted-copies (article-pages a) (paper-gsm p)
                             (article-width-mm a) (article-height-mm a))))
      (invoice-builder shop (shop-generation shop)
        (lambda (shadow)
          (let* ((copy (gethash order-id (shop-orders shadow)))
                 (version (order-version copy)))
            (setf (order-state copy) :delivered)
            (incf (order-version copy))
            (append-event shadow order-id version (order-version copy) :delivered
                          (list :boxes boxes :copies accepted-copies) tick)
            (list :order order-id :boxes boxes :copies accepted-copies
                  :late (> tick (order-deadline o)) :time (old-time tick))))))))

(defun manifest-total (boxes)
  (values (reduce #'+ boxes :key (lambda (b) (getf b :copies)) :initial-value 0)
          (reduce #'+ boxes :key (lambda (b) (getf b :gross-grams)) :initial-value 0)))
