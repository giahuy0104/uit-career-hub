package vn.edu.uit.careerhub.filter;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class ClientIpFilterTest {
    private static final String PROXY = "10.0.0.1";

    @Test void ignoresTheHeaderWhenNoProxyIsTrusted() {
        assertThat(ClientIpFilter.resolve("1.2.3.4", PROXY, 0)).isEqualTo(PROXY);
    }

    @Test void readsTheEntryWrittenByTheOutermostTrustedProxy() {
        assertThat(ClientIpFilter.resolve("203.0.113.9", PROXY, 1)).isEqualTo("203.0.113.9");
        assertThat(ClientIpFilter.resolve("203.0.113.9, 76.76.21.21", PROXY, 2)).isEqualTo("203.0.113.9");
    }

    @Test void aClientCannotForgeItsAddressByPrependingEntries() {
        assertThat(ClientIpFilter.resolve("1.1.1.1, 203.0.113.9, 76.76.21.21", PROXY, 2)).isEqualTo("203.0.113.9");
    }

    @Test void fallsBackWhenTheChainIsShorterThanTheTrustedHops() {
        assertThat(ClientIpFilter.resolve("1.1.1.1", PROXY, 2)).isEqualTo(PROXY);
    }

    @Test void neverReturnsAValueThatPostgresWouldRejectAsInet() {
        for (String junk : new String[] {"abc", "999.1.1.1", "1.2.3", "1.2.3.4:80", "'; DROP TABLE users;--", "unknown", "::g", ""}) {
            assertThat(ClientIpFilter.resolve(junk, PROXY, 1)).as(junk).isEqualTo(PROXY);
        }
        assertThat(ClientIpFilter.resolve(null, "abc", 0)).isNull();
    }

    @Test void acceptsIpv6() {
        assertThat(ClientIpFilter.resolve("2001:db8::1", PROXY, 1)).isEqualTo("2001:db8::1");
        assertThat(ClientIpFilter.resolve(null, "0:0:0:0:0:0:0:1", 0)).isEqualTo("0:0:0:0:0:0:0:1");
    }
}
