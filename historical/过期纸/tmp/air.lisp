(in-package #:printshop/common2)

(defun required-input (output rejects-basis-points setup)
  (unless (and (integerp rejects-basis-points) (<= 0 rejects-basis-points 5000))
    (error "Unsupported spoilage rate"))
  (+ setup (ceiling (* output 10000) (- 10000 rejects-basis-points))))

(defun spoilage-plan (net-sheets processes)
  (let ((need net-sheets) (trace nil))
    (dolist (p (reverse processes))
      (destructuring-bind (kind rate setup) p
        (let ((input (required-input need rate setup)))
          (push (list :kind kind :good need :input input :waste (- input need)) trace)
          (setf need input))))
    (values need trace)))

(defun waste-mass-grams (sheets paper)
  (* sheets (/ (* (paper-width-mm paper) (paper-height-mm paper)
                 (paper-gsm paper)) 1000000)))

(defun recycle-credit (trace p cents-per-kg)
  (let ((waste (reduce #'+ trace :key (lambda (row) (getf row :waste)) :initial-value 0)))
    (floor (* (waste-mass-grams waste p) cents-per-kg) 1000)))

(defun spoilage-sensitivity (net-sheets nominal)
  (loop for offset in '(-100 0 100 250)
        for rate = (max 0 (min 5000 (+ nominal offset)))
        collect (list rate (required-input net-sheets rate 20))))

(defun check-yield (input good setup)
  (unless (and (<= 0 setup input) (<= 0 good (- input setup)))
    (error "Invalid measured production yield"))
  (if (= input setup) 0 (/ good (- input setup))))
