package vn.edu.uit.careerhub.repository;

import java.sql.Array;
import java.util.Collection;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

@Repository
public class TextEmbeddingRepository {
    private final JdbcClient database;

    public TextEmbeddingRepository(JdbcClient database) { this.database = database; }

    public record Stored(String contentHash, float[] vector) {}

    public Map<UUID, Stored> find(String kind, Collection<UUID> ids) {
        Map<UUID, Stored> result = new HashMap<>();
        if (ids.isEmpty()) return result;
        database.sql("SELECT ref_id,content_hash,vector FROM text_embeddings WHERE kind=:kind AND ref_id IN (:ids)")
                .param("kind", kind).param("ids", ids).query((row, n) -> {
                    Array array = row.getArray("vector");
                    Object[] values = (Object[]) array.getArray();
                    float[] vector = new float[values.length];
                    for (int i = 0; i < values.length; i++) vector[i] = ((Number) values[i]).floatValue();
                    result.put(row.getObject("ref_id", UUID.class), new Stored(row.getString("content_hash"), vector));
                    return true;
                }).list();
        return result;
    }

    public void save(String kind, UUID id, String model, String contentHash, float[] vector) {
        StringBuilder literal = new StringBuilder("{");
        for (int i = 0; i < vector.length; i++) literal.append(i == 0 ? "" : ",").append(vector[i]);
        literal.append('}');
        database.sql("""
          INSERT INTO text_embeddings(kind,ref_id,model,content_hash,vector) VALUES(:kind,:id,:model,:hash,CAST(:vector AS real[]))
          ON CONFLICT(kind,ref_id) DO UPDATE SET model=EXCLUDED.model,content_hash=EXCLUDED.content_hash,vector=EXCLUDED.vector,updated_at=now()
          """).param("kind", kind).param("id", id).param("model", model).param("hash", contentHash)
                .param("vector", literal.toString()).update();
    }
}
