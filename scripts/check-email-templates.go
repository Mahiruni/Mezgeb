package main

import (
 "bytes"
 "encoding/json"
 "fmt"
 "html/template"
 "os"
 "strings"
 texttemplate "text/template"
)

type item struct { Key string `json:"key"`; Kind string `json:"kind"`; Subject string `json:"subject"`; File string `json:"file"`; Subjects map[string]string `json:"subjects"` }
func must(err error) { if err != nil { panic(err) } }
func read(path string) string { data,err:=os.ReadFile(path);must(err);return string(data) }
func require(ok bool, label string){if !ok{panic(label)}}
func main(){
 base:="docs/email-templates/"
 var items []item
 must(json.Unmarshal([]byte(read(base+"manifest.json")),&items))
 require(len(items)==13,"expected 13 email events")
 for _,it:=range items {
  for _,locale:=range []string{"en","am","om","unknown",""} {
   fixture:=map[string]any{"Data":map[string]any{"locale":locale},"ConfirmationURL":"https://example.invalid/verify?token=synthetic&redirect_to=https%3A%2F%2Fexample.invalid","Token":"123456","Provider":"Example <provider>","FactorType":"Synthetic factor"}
   if locale==""{delete(fixture,"Data")}
   expected:="en";if it.Kind!="security"&&(locale=="am"||locale=="om"){expected=locale}
   h,err:=template.New(it.Key).Parse(read(base+it.File));must(err)
   var rendered bytes.Buffer;must(h.Execute(&rendered,fixture))
   result:=rendered.String()
   require(strings.Contains(result,"lang=\""+expected+"\""),it.Key+" incorrect locale "+locale)
   require(!strings.Contains(result,"{{")&&!strings.Contains(result,"ZgotmplZ"),it.Key+" unresolved template")
   require(strings.Contains(result,"Mezgeb"),it.Key+" missing brand")
   if it.Kind=="link"{require(strings.Contains(result,"example.invalid/verify?token=synthetic"),it.Key+" lost secure action")}
   if it.Kind=="code"{require(strings.Contains(result,"123456"),it.Key+" missing code")}
   if strings.HasPrefix(it.Key,"identity_"){require(strings.Contains(result,"Example &lt;provider&gt;"),it.Key+" unsafe provider rendering")}
   st,err:=texttemplate.New(it.Key).Parse(it.Subject);must(err)
   var subj bytes.Buffer;must(st.Execute(&subj,fixture))
   require(subj.String()==it.Subjects[expected],it.Key+" wrong subject")
  }
 }
 fmt.Println("Go HTML and subject rendering passed: 65 event/locale fixtures, including missing metadata and escaping.")
}
