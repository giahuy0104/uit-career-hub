package vn.edu.uit.careerhub.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.UUID;

import org.junit.jupiter.api.Test;

import vn.edu.uit.careerhub.common.AppException;
import vn.edu.uit.careerhub.config.AppProperties;

class TokenServiceTest {
    @Test void signsAndVerifiesStudentContext(){TokenService service=new TokenService(properties("0123456789abcdefghijklmnopqrstuvwxyz"));UUID userId=UUID.randomUUID(),studentId=UUID.randomUUID();AuthUser user=new AuthUser(userId,"student@student.uit.edu.vn",UserRole.STUDENT,UserStatus.ACTIVE,null,0,null,"Student","UIT",studentId,null);var token=service.signAccessToken(user);var principal=service.verifyAccessToken(token.accessToken());assertThat(principal.userId()).isEqualTo(userId);assertThat(principal.studentProfileId()).isEqualTo(studentId);assertThat(principal.role()).isEqualTo(UserRole.STUDENT);assertThat(token.expiresIn()).isEqualTo(900);}
    @Test void rejectsTamperedToken(){TokenService service=new TokenService(properties("0123456789abcdefghijklmnopqrstuvwxyz"));AuthUser user=new AuthUser(UUID.randomUUID(),"admin@uit.edu.vn",UserRole.UIT_ADMIN,UserStatus.ACTIVE,null,0,null,"Admin","UIT",null,null);String token=service.signAccessToken(user).accessToken();assertThatThrownBy(()->service.verifyAccessToken(token.substring(0,token.length()-2)+"aa")).isInstanceOf(AppException.class);}
    @Test void createsOpaqueRefreshTokensAndStableHashes(){TokenService service=new TokenService(properties("0123456789abcdefghijklmnopqrstuvwxyz"));String first=service.createRefreshToken(),second=service.createRefreshToken();assertThat(first).hasSize(64).isNotEqualTo(second);assertThat(service.hashOpaqueToken(first)).hasSize(64).isEqualTo(service.hashOpaqueToken(first));}
    @Test void rejectsWeakSigningSecret(){assertThatThrownBy(()->new TokenService(properties("too-short"))).isInstanceOf(IllegalStateException.class);}
    private AppProperties properties(String secret){return new AppProperties("test","http://localhost:5173","http://localhost:5173",new AppProperties.Database("postgresql://localhost/test","",5),new AppProperties.Security(secret,"issuer","audience",900,7,"refresh",false,"lax","student.uit.edu.vn"),new AppProperties.Email(false,"","",10,5),new AppProperties.Storage(false,"","","","bucket",600,300),"cron-secret");}
}
