(in-package #:printshop/common2)

(defun rework-subgraph (steps failed-id suffix)
  (let ((affected (list failed-id)))
    (loop for changed = nil do
      (dolist (s steps)
        (when (and (not (member (step-id s) affected :test #'equal))
                   (some (lambda (d) (member d affected :test #'equal)) (step-dependencies s)))
          (push (step-id s) affected) (setf changed t)))
      until (not changed))
    (mapcar
      (lambda (s)
        (let ((copy (copy-step s)))
          (setf (step-id copy) (concatenate 'string (step-id s) suffix)
                (step-state copy) :waiting
                (step-dependencies copy)
                  (mapcar (lambda (d)
                            (if (member d affected :test #'equal)
                                (concatenate 'string d suffix) d))
                          (step-dependencies s)))
          copy))
      (remove-if-not (lambda (s) (member (step-id s) affected :test #'equal)) steps))))

(defun rework-plan (steps failed-id scrap-copies attempt)
  (require-positive-integer scrap-copies 'scrap-copies)
  (unless (<= 1 attempt 3) (error "Rework attempts limited to three"))
  (let ((replacement (rework-subgraph steps failed-id (format nil "-R~D" attempt))))
    (unless replacement (error "Failed production step absent"))
    (dolist (s replacement)
      (let ((original (step-quantity s)))
        (setf (step-quantity s) (min scrap-copies original)
              (step-minutes s) (+ 5 (ceiling (* (step-minutes s) scrap-copies) (max 1 original))))))
    (list :original-steps steps :replacement-steps replacement
          :quarantined-copies scrap-copies :attempt attempt)))

(defun merge-rework-evidence (first-run repaired)
  (list :first (copy-tree first-run) :repair (copy-tree repaired)
        :complete (and (getf first-run :inspected) (getf repaired :inspected))
        :total-scrap (+ (getf first-run :defects 0) (getf repaired :defects 0))))
