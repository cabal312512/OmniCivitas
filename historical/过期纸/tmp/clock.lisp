(in-package #:printshop/common2)

(defun overlaps-p (begin end booking)
  (and (< begin (booking-end booking)) (< (booking-begin booking) end)))

(defun next-gap (machine start duration bookings &key (horizon 10080))
  (let ((cursor start)
        (calendar (sort (remove-if-not
                         (lambda (b) (equal machine (booking-machine-id b)))
                         (copy-list bookings)) #'< :key #'booking-begin)))
    (dolist (b calendar)
      (when (overlaps-p cursor (+ cursor duration) b)
        (setf cursor (booking-end b))))
    (when (> (+ cursor duration) horizon) (error "Finite scheduling horizon exhausted"))
    cursor))

(defun plan-order (o shop &key (begin 0) (horizon 10080))
  (let* ((quote (reply-value (quote-order o shop)))
         (steps (topological-steps (production-steps o quote)))
         (ends (make-hash-table :test #'equal))
         (calendar (copy-list (shop-bookings shop)))
         (created nil))
    (dolist (s steps)
      (let* ((earliest (reduce #'max (step-dependencies s)
                               :key (lambda (d) (gethash d ends begin)) :initial-value begin))
             (start (next-gap (step-machine-id s) earliest (step-minutes s)
                              calendar :horizon horizon))
             (finish (+ start (step-minutes s)))
             (b (make-booking :step-id (step-id s) :machine-id (step-machine-id s)
                              :begin start :end finish)))
        (push b calendar) (push b created) (setf (gethash (step-id s) ends) finish)))
    (let ((finish (reduce #'max created :key #'booking-end :initial-value begin)))
      (make-reply :error-message t :value
        (list :steps steps :bookings (nreverse created) :finish finish
              :late-by (max 0 (- finish (order-deadline o))))))))

(defun calendar-conflicts (bookings)
  (loop for tail on bookings append
    (loop for right in (cdr tail)
          when (and (equal (booking-machine-id (car tail)) (booking-machine-id right))
                    (overlaps-p (booking-begin (car tail)) (booking-end (car tail)) right))
          collect (list (booking-step-id (car tail)) (booking-step-id right)))))
