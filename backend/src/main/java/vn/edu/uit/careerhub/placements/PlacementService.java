package vn.edu.uit.careerhub.placements;

import java.time.LocalDate;
import java.time.ZoneId;
import java.util.Map;
import java.util.UUID;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;

import vn.edu.uit.careerhub.auth.RequestMetadata;
import vn.edu.uit.careerhub.common.AppException;
import vn.edu.uit.careerhub.placements.PlacementModels.Locked;
import vn.edu.uit.careerhub.placements.PlacementModels.Status;
import vn.edu.uit.careerhub.placements.PlacementRequests.Transition;

@Service
public class PlacementService {
    private final PlacementRepository repository;private final TransactionTemplate transactions;
    public PlacementService(PlacementRepository repository,TransactionTemplate transactions){this.repository=repository;this.transactions=transactions;}
    public Map<String,Object> transition(UUID actorId,UUID placementId,UUID commandId,boolean complete,Transition input,RequestMetadata request){
        Status from=complete?Status.STARTED:Status.HIRED;Status to=complete?Status.COMPLETED:Status.STARTED;
        return transactions.execute(status->{
            Locked placement=repository.lock(placementId).orElseThrow(this::notFound);
            Status repeated=repository.command(placementId,commandId).orElse(null);
            if(repeated!=null){if(repeated!=to)throw new AppException(HttpStatus.CONFLICT,"IDEMPOTENCY_KEY_REUSED","Idempotency-Key đã được dùng cho một chuyển trạng thái khác.");return repository.find(placementId).orElseThrow(this::notFound);}
            if(placement.status()!=from)throw new AppException(HttpStatus.CONFLICT,"INTERNSHIP_PLACEMENT_STATE_CONFLICT",complete?"Chỉ kỳ thực tập đang diễn ra mới có thể hoàn thành.":"Chỉ kỳ thực tập ở trạng thái đã xác nhận mới có thể bắt đầu.");
            if(placement.version()!=input.expectedVersion())throw new AppException(HttpStatus.CONFLICT,"INTERNSHIP_PLACEMENT_VERSION_CONFLICT","Dữ liệu kỳ thực tập đã thay đổi. Vui lòng tải lại trước khi thao tác.");
            if(input.effectiveDate().isAfter(LocalDate.now(ZoneId.of("Asia/Ho_Chi_Minh"))))throw new AppException(HttpStatus.BAD_REQUEST,"INTERNSHIP_PLACEMENT_DATE_IN_FUTURE","Ngày hiệu lực không được nằm trong tương lai.");
            if(complete&&placement.actualStartDate()!=null&&input.effectiveDate().isBefore(placement.actualStartDate()))throw new AppException(HttpStatus.BAD_REQUEST,"INTERNSHIP_PLACEMENT_DATE_ORDER_INVALID","Ngày hoàn thành không được trước ngày bắt đầu thực tập.");
            repository.transition(placement,actorId,commandId,to,input.effectiveDate(),input.note()==null?null:input.note().strip(),request);
            return repository.find(placementId).orElseThrow(this::notFound);
        });
    }
    private AppException notFound(){return new AppException(HttpStatus.NOT_FOUND,"INTERNSHIP_PLACEMENT_NOT_FOUND","Không tìm thấy kỳ thực tập.");}
}
