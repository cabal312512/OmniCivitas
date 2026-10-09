(defpackage #:printshop/common2
  (:use #:cl)
  (:export #:quote-order #:plan-order #:revise-order #:shipment #:replay
           #:synthetic-shop #:synthetic-order #:decode-parcel #:encode-parcel))
(in-package #:printshop/common2)

(defstruct paper id width-mm height-mm gsm grain cents-per-sheet available)
(defstruct article id width-mm height-mm pages copies colors duplex binding)
(defstruct order id article paper-id deadline version state notes)
(defstruct layout columns rows rotation signatures sheets blank-pages utilization)
(defstruct press id name colors width-mm height-mm sheets-per-hour setup-minutes)
(defstruct step id order-id kind dependencies minutes machine-id quantity state)
(defstruct booking step-id machine-id begin end)
(defstruct event sequence order-id before-version after-version kind payload tick)
(defstruct parcel schema words digest)
(defstruct reply error-message success-reason value)
(defstruct shop
  (orders (make-hash-table :test #'equal))
  (papers (make-hash-table :test #'equal))
  (machines (make-hash-table :test #'equal))
  (warehouse-stock (make-hash-table :test #'equal))
  (order-items (make-hash-table :test #'equal))
  (bookings nil) (events nil) (generation 0) (retired nil))

(defun require-positive-integer (value label &optional (limit 1000000))
  (unless (and (integerp value) (< 0 value) (<= value limit))
    (error "~A requires a positive integer no larger than ~D" label limit))
  value)

(defun cents-half-up (numerator denominator)
  (unless (plusp denominator) (error "Invalid financial denominator"))
  (floor (+ numerator (floor denominator 2)) denominator))

(defun checksum-words (words)
  (reduce (lambda (acc n) (mod (+ (* 33 acc) n) 1000000007)) words :initial-value 5381))

(defun clone-table (table copier)
  (let ((copy (make-hash-table :test (hash-table-test table))))
    (maphash (lambda (key value) (setf (gethash key copy) (funcall copier value))) table)
    copy))

(defun closed-p (state)
  (member state '(:delivered :cancelled :tombstone)))

(defun old-time (tick)
  (list :day (floor tick 1440) :minute (mod tick 1440) :ticks (* tick 600000000)))
