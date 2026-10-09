(in-package #:printshop/common2)

(defun production-steps (o quote)
  (let* ((id (order-id o)) (a (order-article o))
         (input (getf quote :input-sheets))
         (print-id (format nil "~A/3" id))
         (cut-id (format nil "~A/8" id))
         (finish-id (format nil "~A/1" id)))
    (list
      (make-step :id (format nil "~A/0" id) :order-id id :kind :preflight
                 :dependencies nil :minutes 18 :machine-id :desk :quantity 1 :state :waiting)
      (make-step :id print-id :order-id id :kind :print
                 :dependencies (list (format nil "~A/0" id)) :minutes (ceiling input 20)
                 :machine-id (getf quote :press) :quantity input :state :waiting)
      (make-step :id cut-id :order-id id :kind :cut :dependencies (list print-id)
                 :minutes (+ 8 (ceiling input 100)) :machine-id :cutter
                 :quantity (article-copies a) :state :waiting)
      (make-step :id finish-id :order-id id :kind (article-binding a)
                 :dependencies (list cut-id) :minutes (+ 12 (ceiling (article-copies a) 30))
                 :machine-id :finisher :quantity (article-copies a) :state :waiting)
      (make-step :id (format nil "~A/9" id) :order-id id :kind :pack
                 :dependencies (list finish-id) :minutes (ceiling (article-copies a) 80)
                 :machine-id :desk :quantity (article-copies a) :state :waiting))))

(defun topological-steps (steps)
  (let ((remaining (copy-list steps)) (done nil) (output nil))
    (loop while remaining do
      (let ((ready (remove-if-not
                    (lambda (s) (every (lambda (d) (member d done :test #'equal))
                                       (step-dependencies s))) remaining)))
        (when (null ready) (error "Cyclic or missing process dependency"))
        (dolist (s (sort ready #'string< :key #'step-id))
          (push (step-id s) done) (push s output)
          (setf remaining (remove s remaining)))))
    (nreverse output)))

(defun keep-dependencies (shop order-id steps)
  (setf (gethash order-id (shop-warehouse-stock shop))
        (mapcar (lambda (s) (cons (step-id s) (copy-list (step-dependencies s)))) steps)))
