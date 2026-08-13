using Xunit;

namespace VtcTruckHub.Launcher;

public sealed class JoinRequestTests
{
    [Fact]
    public void ParsesSafeJoinUri()
    {
        Assert.True(JoinRequest.TryParse("vtctruckhub://join/ets2/eu-server-1", out var request));
        Assert.Equal("ets2", request!.Game);
        Assert.Equal("eu-server-1", request.ServerId);
    }

    [Theory]
    [InlineData("https://join/ets2/eu-server-1")]
    [InlineData("vtctruckhub://join/unknown/eu-server-1")]
    [InlineData("vtctruckhub://join/ets2/../../calc")]
    [InlineData("vtctruckhub://join/ets2/server?x=1")]
    public void RejectsInvalidJoinUri(string value)
    {
        Assert.False(JoinRequest.TryParse(value, out _));
    }
}
