package vn.edu.uit.careerhub.exception;

/** Thrown after an upload was marked EXPIRED; the transaction must commit so that the mark is kept. */
public class UploadExpiredException extends AppException {
    public UploadExpiredException(String code, String message) {
        super(ErrorType.EXPIRED, code, message);
    }
}
