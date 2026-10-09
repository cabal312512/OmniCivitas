(in-package #:printshop/common2)

(defun bounded-decimal (text start end maximum)
  (unless (<= 0 start end (length text)) (error "Field range outside fixed record"))
  (let ((n 0))
    (loop for i from start below end
          for digit = (digit-char-p (char text i)) do
      (unless digit (error "Non-decimal fixed field"))
      (setf n (+ (* n 10) digit))
      (when (> n maximum) (error "Fixed field exceeds domain bound")))
    n))

(defun parse-legacy-order (text)
  (unless (and (= (length text) 54) (string= text "P02" :end1 3))
    (error "Legacy order requires 54 columns and P02 version"))
  (let* ((id (string-trim '(#\Space) (subseq text 3 15)))
         (copies (bounded-decimal text 15 23 1000000))
         (pages (bounded-decimal text 23 28 10000))
         (width (bounded-decimal text 28 33 2000))
         (height (bounded-decimal text 33 38 2000))
         (colors (bounded-decimal text 38 40 12))
         (deadline (bounded-decimal text 40 47 1000000))
         (paper-id (string-trim '(#\Space) (subseq text 47 53)))
         (duplex (case (char text 53) (#\2 t) (#\1 nil)
                   (otherwise (error "Legacy duplex marker unsupported")))))
    (make-order :id id :paper-id paper-id :deadline deadline :version 1 :state :draft
                :article (make-article :id id :copies copies :pages pages :width-mm width
                                       :height-mm height :colors colors :duplex duplex :binding :loose))))

(defun legacy-row (o)
  (let ((a (order-article o)))
    (format nil "P02~12A~8,'0D~5,'0D~5,'0D~5,'0D~2,'0D~7,'0D~6A~A"
            (order-id o) (article-copies a) (article-pages a)
            (article-width-mm a) (article-height-mm a) (article-colors a)
            (order-deadline o) (order-paper-id o) (if (article-duplex a) "2" "1"))))
