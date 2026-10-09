(in-package #:printshop/common2)

(defun inspected-ratio (defects inspected)
  (unless (and (integerp inspected) (plusp inspected) (<= 0 defects inspected))
    (error "Invalid inspection counts"))
  (/ defects inspected))

(defun wilson-band (defects inspected &optional (z 1.959963984540054d0))
  (let* ((p (coerce (inspected-ratio defects inspected) 'double-float))
         (z2 (* z z))
         (den (+ 1d0 (/ z2 inspected)))
         (center (/ (+ p (/ z2 (* 2 inspected))) den))
         (half (/ (* z (sqrt (+ (/ (* p (- 1d0 p)) inspected)
                                (/ z2 (* 4 inspected inspected))))) den)))
    (values (max 0d0 (- center half)) (min 1d0 (+ center half)))))

(defun inspect-run (measurements target tolerance)
  (unless (plusp tolerance) (error "Inspection tolerance must be positive"))
  (let ((defects 0) (missing 0) (peak 0) (sum 0) (count 0))
    (dolist (x measurements)
      (cond ((null x) (incf missing))
            ((not (realp x)) (error "Non-numeric registration measurement"))
            (t (let ((residual (- x target)))
                 (incf count) (incf sum residual)
                 (setf peak (max peak (abs residual)))
                 (when (> (abs residual) tolerance) (incf defects))))))
    (if (zerop count)
        (make-reply :success-reason :no-evidence)
        (multiple-value-bind (low high) (wilson-band defects count)
          (make-reply :error-message t :value
            (list :inspected count :missing missing :defects defects
                  :mean-residual (/ sum count) :peak-residual peak
                  :defect-band (list low high)))))))

(defun acceptance (inspection threshold)
  (let ((data (reply-value inspection)))
    (and (reply-error-message inspection)
         (zerop (getf data :missing))
         (<= (second (getf data :defect-band)) threshold))))
