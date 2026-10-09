(in-package #:printshop/common2)

(defun rotate-dimensions (width height rotated)
  (if rotated (values height width) (values width height)))

(defun impose (a p &key (bleed-mm 3) (gutter-mm 4) (gripper-mm 12))
  (require-positive-integer (article-pages a) 'pages 10000)
  (require-positive-integer (article-copies a) 'copies)
  (let ((best nil) (usable-height (- (paper-height-mm p) gripper-mm)))
    (dolist (rotated '(nil t))
      (multiple-value-bind (w h)
          (rotate-dimensions (article-width-mm a) (article-height-mm a) rotated)
        (let* ((pitch-w (+ w (* 2 bleed-mm) gutter-mm))
               (pitch-h (+ h (* 2 bleed-mm) gutter-mm))
               (columns (floor (+ (paper-width-mm p) gutter-mm) pitch-w))
               (rows (floor (+ usable-height gutter-mm) pitch-h))
               (up (* columns rows)))
          (when (plusp up)
            (let* ((faces (if (article-duplex a) 2 1))
                   (pages-per-sheet (* up faces))
                   (signatures (ceiling (article-pages a) pages-per-sheet))
                   (blank (- (* signatures pages-per-sheet) (article-pages a)))
                   (sheets (* signatures (article-copies a)))
                   (candidate (make-layout
                     :columns columns :rows rows :rotation rotated
                     :signatures signatures :sheets sheets :blank-pages blank
                     :utilization (/ (* up w h)
                                     (* (paper-width-mm p) (paper-height-mm p))))))
              (when (or (null best) (< sheets (layout-sheets best))
                        (and (= sheets (layout-sheets best))
                             (> (layout-utilization candidate) (layout-utilization best))))
                (setf best candidate)))))))
    (or best (error "No valid imposition fits this stock"))))

(defun grain-compatible-p (a p l)
  (let ((spine-axis (if (layout-rotation l) :horizontal :vertical)))
    (or (eq (article-binding a) :loose)
        (eq (paper-grain p) spine-axis))))

(defun signature-map (pages up)
  (let ((capacity (* 2 up)) (output nil))
    (loop for base from 0 below pages by capacity do
      (let ((last (+ base capacity -1)))
        (push (loop for offset below up
                    collect (list (1+ (+ base offset))
                                  (let ((back (1+ (- last offset))))
                                    (if (> back pages) :blank back)))) output)))
    (nreverse output)))
