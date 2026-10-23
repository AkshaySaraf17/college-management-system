package com.cms.backend.common;

import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Component;

import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/** Thin wrapper over JdbcClient that returns camelCased row maps, used by the SQL-first modules. */
@Component
public class Db {

    private final JdbcClient jdbc;

    public Db(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    public List<Map<String, Object>> list(String sql, Object... args) {
        return jdbc.sql(sql).params(Arrays.asList(args)).query().listOfRows().stream().map(Db::camel).toList();
    }

    public Optional<Map<String, Object>> find(String sql, Object... args) {
        return list(sql, args).stream().findFirst();
    }

    public Map<String, Object> one(String sql, String notFoundMessage, Object... args) {
        return find(sql, args).orElseThrow(() -> ApiException.notFound(notFoundMessage));
    }

    public <T> T scalar(Class<T> type, String sql, Object... args) {
        return jdbc.sql(sql).params(Arrays.asList(args)).query(type).optional().orElse(null);
    }

    public boolean exists(String sql, Object... args) {
        return !jdbc.sql(sql).params(Arrays.asList(args)).query().listOfRows().isEmpty();
    }

    public int exec(String sql, Object... args) {
        return jdbc.sql(sql).params(Arrays.asList(args)).update();
    }

    private static Map<String, Object> camel(Map<String, Object> row) {
        Map<String, Object> out = new LinkedHashMap<>();
        row.forEach((k, v) -> out.put(toCamel(k), v));
        return out;
    }

    private static String toCamel(String snake) {
        StringBuilder sb = new StringBuilder();
        boolean up = false;
        for (char c : snake.toCharArray()) {
            if (c == '_') {
                up = true;
            } else {
                sb.append(up ? Character.toUpperCase(c) : c);
                up = false;
            }
        }
        return sb.toString();
    }
}
