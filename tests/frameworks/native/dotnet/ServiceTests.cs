using System.Xml.Linq;
using Xunit;
public class ServiceTests {
    static readonly HttpClient Client=new(){Timeout=TimeSpan.FromSeconds(6)};
    [Fact] public async Task SoapPreservesNamespaceAndIndependentId(){
        var response=await Client.GetAsync("http://dotnet:8003/api/AirTaxService.asmx");
        response.EnsureSuccessStatusCode();
        var xml=XDocument.Parse(await response.Content.ReadAsStringAsync());
        Assert.Equal("http://schemas.xmlsoap.org/soap/envelope/",xml.Root!.Name.NamespaceName);
        Assert.Equal("true",xml.Descendants("canContinue").Single().Value);
        Assert.Equal("0",xml.Descendants("tax").Single().Value);
        Assert.True(Guid.TryParse(xml.Descendants("displayRequestId").Single().Value,out _));
    }
    [Fact] public async Task HealthIsNotSoap(){
        var response=await Client.GetAsync("http://dotnet:8003/health");
        response.EnsureSuccessStatusCode();
        Assert.Contains("true",await response.Content.ReadAsStringAsync());
    }
}
